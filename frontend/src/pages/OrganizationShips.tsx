import { AddShipDialog } from '@/components/AddShipDialog';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { FleetBreakdownPanel } from '@/components/fleet/FleetBreakdownPanel';
import { ShipDistributionCharts } from '@/components/fleet/ShipDistributionCharts';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { DataTable, type DataTableColumn } from '@/components/shared';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { organizationKeys } from '@/hooks/queries/queryKeys';
import { useFleetStatistics } from '@/hooks/queries/useFleetQueries';
import {
  useLoanOrgShip,
  useOrgShips,
  useReturnOrgShipLoan,
} from '@/hooks/queries/useOrgShipQueries';
import { useShipCatalogue } from '@/hooks/queries/useShipCatalogueQueries';
import { useDebounce } from '@/hooks/useDebounce';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  ORGANIZATION_SHIPS_FILTER_DEFAULTS,
  parseOrganizationShipsFilters,
} from '@/pages/organizationShipsFilters';
import { apiClient } from '@/services/apiClient';
import {
  organizationShipService,
  type CreateOrgShipInput,
} from '@/services/organizationShipService';
import { shipLoanService } from '@/services/shipLoanService';
import { userShipService } from '@/services/userShipService';
import { useAuthStore, useHasMinOrgRole } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { formatShipLabel } from '@/utils/shipColorUtils';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupsIcon from '@mui/icons-material/Groups';
import HandshakeIcon from '@mui/icons-material/Handshake';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplyIcon from '@mui/icons-material/Reply';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
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
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pie, PieChart, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

/* ---------- Types ---------- */

interface OrgShip {
  id: string;
  shipName: string;
  customName?: string;
  role?: string;
  size?: string;
  manufacturer?: string;
  /** Catalogue-derived primary role (e.g. "Bomber"). Takes precedence over `role` for filtering. */
  shipRole?: string;
  /** Catalogue-derived size (e.g. "Small", "Large"). Takes precedence over `size` for filtering. */
  shipSize?: string;
  /** Catalogue-derived manufacturer. Takes precedence over `manufacturer` for filtering. */
  shipManufacturer?: string;
  status: string;
  condition: string;
  location?: string;
  isAvailable?: boolean;
  isCapital?: boolean;
  assignedCaptain?: string;
  assignedCrew?: string[];
  maxCrew?: number;
}

interface MemberShip {
  id: string;
  shipName: string;
  customName?: string;
  status: string;
  condition: string;
  location?: string;
  sharingLevel: string;
  userId?: string;
  username?: string;
  ownerName?: string;
  /** Catalogue-derived primary role (e.g. "Bomber"). */
  shipRole?: string;
  /** Catalogue-derived size (e.g. "Small", "Large"). */
  shipSize?: string;
  /** Catalogue-derived manufacturer. */
  shipManufacturer?: string;
}

/** Unified fleet ship that can represent both org-owned and member-owned ships */
interface FleetShip {
  id: string;
  shipName: string;
  customName?: string;
  role?: string;
  size?: string;
  manufacturer?: string;
  status: string;
  condition: string;
  location?: string;
  isAvailable?: boolean;
  isCapital?: boolean;
  assignedCaptain?: string;
  assignedCrew?: string[];
  maxCrew?: number;
  ownership: 'org' | 'member';
  ownerName?: string;
  sharingLevel?: string;
}

/* ---------- Helpers ---------- */

/** Build dropdown options dynamically from statistics data */
function buildFilterOptions(
  stats: Record<string, number> | undefined,
  allLabel: string,
  labelFn: (key: string) => string
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [{ value: 'all', label: allLabel }];
  if (!stats) return options;
  return [
    ...options,
    ...Object.entries(stats)
      .filter(([key]) => key.toLowerCase() !== 'unknown')
      .sort(([, a], [, b]) => b - a)
      .map(([key]) => ({ value: key, label: labelFn(key) })),
  ];
}

const getStatusBgColor = (status: string, t: Theme): string => {
  switch (status) {
    case 'available':
    case 'owned':
      return alpha(t.palette.success.main, 0.15);
    case 'unavailable':
    case 'destroyed':
      return alpha(t.palette.error.main, 0.15);
    default:
      return alpha(t.palette.info.main, 0.15);
  }
};

const getConditionBgColor = (condition: string, t: Theme): string => {
  switch (condition) {
    case 'excellent':
    case 'pristine':
      return alpha(t.palette.success.main, 0.15);
    case 'good':
      return alpha(t.palette.success.light, 0.15);
    case 'fair':
      return alpha(t.palette.warning.main, 0.15);
    case 'poor':
    case 'damaged':
    case 'critical':
      return alpha(t.palette.error.main, 0.15);
    default:
      return alpha(t.palette.info.main, 0.15);
  }
};

/* ---------- Component ---------- */

const OrganizationShips: React.FC = () => {
  const theme = useTheme();
  const { orgId: paramOrgId } = useParams();
  const user = useAuthStore(state => state.user);
  const orgId = paramOrgId ?? user?.activeOrgId ?? user?.organizationId;
  const queryClient = useQueryClient();
  const canManageShips = useHasMinOrgRole('officer');

  const { filters: urlFilters, updateFilters } = useUrlFilters({
    parse: parseOrganizationShipsFilters,
    defaults: ORGANIZATION_SHIPS_FILTER_DEFAULTS,
    paginationKeys: ['page'] as const,
  });
  const activeTab = urlFilters.tab;
  const setActiveTab = (v: number) => updateFilters({ tab: v });
  const filterRole = urlFilters.role;
  const setFilterRole = (next: string | ((prev: string) => string)) =>
    updateFilters({ role: typeof next === 'function' ? next(filterRole) : next });
  const filterSize = urlFilters.size;
  const setFilterSize = (next: string | ((prev: string) => string)) =>
    updateFilters({ size: typeof next === 'function' ? next(filterSize) : next });
  const filterOwnership = urlFilters.ownership;
  const setFilterOwnership = (v: 'all' | 'org' | 'member') => updateFilters({ ownership: v });
  const filterFleet = urlFilters.fleet;
  const filterMemberOwner = urlFilters.memberOwner;
  const [searchTerm, setSearchTerm] = useState(urlFilters.search);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const notification = useNotification();

  // Pagination state (member ships tab only — org fleet uses client-side pagination via DataTable)
  const memberPage = urlFilters.page;
  const setMemberPage = (v: number) => updateFilters({ page: v });
  const memberPageSize = urlFilters.pageSize;
  const setMemberPageSize = (v: number) => updateFilters({ pageSize: v });

  // Loan dialog state (for org-owned ships)
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [loanShip, setLoanShip] = useState<OrgShip | null>(null);
  const [loanBorrowerId, setLoanBorrowerId] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanError, setLoanError] = useState<string | null>(null);

  // Loans tab sub-view
  const loansSubTab = urlFilters.loansSubTab;
  const setLoansSubTab = (v: number) => updateFilters({ loansSubTab: v });
  const statsOpen = urlFilters.statsOpen === 'true';
  const setStatsOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(statsOpen) : next;
    updateFilters({ statsOpen: resolved ? 'true' : 'false' });
  };

  // Debounce search for server-side query to avoid re-fetch on every keystroke
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Fleet statistics (role/size breakdown from backend)
  const { data: fleetStats } = useFleetStatistics(orgId);

  // Ship catalogue lookup for enriching fleet with game role & size
  const { data: catalogueData } = useShipCatalogue({ limit: 500 }, !!orgId);
  const catalogueLookup = useMemo(() => {
    const map = new Map<string, { role?: string; size?: string; manufacturer?: string }>();
    if (!catalogueData?.items) return map;
    for (const item of catalogueData.items) {
      map.set(item.name.toLowerCase(), {
        role: item.role,
        size: item.size,
        manufacturer: item.manufacturer,
      });
    }
    return map;
  }, [catalogueData?.items]);

  // Build dynamic filter options from actual statistics data
  const roleOptions = useMemo(
    () => buildFilterOptions(fleetStats?.ships?.byRole, 'All Roles', formatShipLabel),
    [fleetStats?.ships?.byRole]
  );
  const sizeOptions = useMemo(
    () => buildFilterOptions(fleetStats?.ships?.bySize, 'All Sizes', formatShipLabel),
    [fleetStats?.ships?.bySize]
  );

  // Fleet overview: single query replaces N+1 per-fleet ship requests (P7/C7)
  const { data: fleetOverviewData } = useQuery({
    queryKey: [...organizationKeys.detail(orgId ?? ''), 'fleet-overview'],
    queryFn: async () => {
      const resp = await apiClient.get<{
        fleets: unknown[];
        shipNameToFleets: Record<string, string[]>;
      }>(`/api/v2/organizations/${orgId}/fleet-overview`);
      return resp.data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Ship name → fleet names mapping from overview endpoint (replaces N useQueries)
  const shipNameToFleets = useMemo(() => {
    if (!fleetOverviewData?.shipNameToFleets) return new Map<string, string[]>();
    return new Map(Object.entries(fleetOverviewData.shipNameToFleets));
  }, [fleetOverviewData?.shipNameToFleets]);

  // Dynamic fleet options derived from overview data
  const orgFleetOptions = useMemo((): Array<{ value: string; label: string }> => {
    const base: Array<{ value: string; label: string }> = [{ value: 'all', label: 'All Fleets' }];
    if (!fleetOverviewData?.fleets) return base;
    const fleets = fleetOverviewData.fleets as Array<{ id: string; name: string }>;
    return [
      ...base,
      ...fleets
        .filter(f => f.name)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(f => ({ value: f.name, label: f.name })),
    ];
  }, [fleetOverviewData?.fleets]);

  // React Query hooks — fetch all org ships for client-side filtering (P7/C3)
  // All filtering (role, size, search) is done client-side in filteredFleet below,
  // so we don't send search/filter params to the server.
  // Limit set to 500 to cover large fleets — client-side filtering handles the rest.
  const orgShipFilters = useMemo(() => {
    const f: Record<string, unknown> = {};
    f.limit = 500;
    f.page = 1;
    return f;
  }, []);
  const {
    data: orgShipsRaw,
    isLoading: loadingOrg,
    error: orgQueryError,
    isFetching: refreshingOrg,
  } = useOrgShips(orgId ?? '', orgShipFilters);

  const {
    data: memberShipsRaw,
    isLoading: loadingMember,
    error: memberQueryError,
    isFetching: refreshingMember,
  } = useQuery({
    queryKey: [...organizationKeys.detail(orgId ?? ''), 'member-ships'],
    queryFn: () => userShipService.getOrgAvailableShips(orgId!),
    enabled: !!orgId,
  });

  // Extract arrays and pagination from response envelopes
  const orgShipsEnvelope: Record<string, unknown> | unknown[] | undefined = orgShipsRaw as
    | Record<string, unknown>
    | unknown[]
    | undefined;
  const orgShips: OrgShip[] = (() => {
    if (Array.isArray(orgShipsEnvelope)) return orgShipsEnvelope as OrgShip[];
    if (
      orgShipsEnvelope &&
      !Array.isArray(orgShipsEnvelope) &&
      Array.isArray(orgShipsEnvelope.data)
    )
      return orgShipsEnvelope.data as OrgShip[];
    return [];
  })();
  const orgShipsPagination: Record<string, number> | undefined = (() => {
    if (!orgShipsEnvelope || Array.isArray(orgShipsEnvelope)) return undefined;
    const env = orgShipsEnvelope;
    return (env.pagination ?? env.meta) as Record<string, number> | undefined;
  })();
  const totalOrgShips = orgShipsPagination?.total ?? orgShips.length;

  const memberShips = (() => {
    if (Array.isArray(memberShipsRaw)) return memberShipsRaw as MemberShip[];
    if (Array.isArray((memberShipsRaw as Record<string, unknown>)?.data))
      return (memberShipsRaw as Record<string, unknown[]>).data as MemberShip[];
    return [] as MemberShip[];
  })();
  const totalMemberShips = memberShips.length;

  // Build a unified fleet combining both org-owned and member-owned ships.
  // Ships are enriched with game role/size/manufacturer using a priority chain:
  //   1. Backend-provided `shipRole`/`shipSize`/`shipManufacturer` (authoritative,
  //      resolved via a server-side join against the ships catalogue).
  //   2. Client-side `catalogueLookup` fallback (kept for resilience if the
  //      backend hasn't been redeployed yet).
  //   3. The entity's own `role`/`size`/`manufacturer` values.
  const combinedFleet: FleetShip[] = useMemo(() => {
    const enrich = (shipName: string) => catalogueLookup.get((shipName ?? '').toLowerCase());
    const orgFleetShips: FleetShip[] = orgShips.map(s => {
      const cat = enrich(s.shipName);
      return {
        ...s,
        role: s.shipRole ?? cat?.role ?? s.role,
        size: s.shipSize ?? cat?.size ?? s.size,
        manufacturer: s.shipManufacturer ?? cat?.manufacturer ?? s.manufacturer,
        ownership: 'org' as const,
        ownerName: 'Organization',
      };
    });
    const memberFleetShips: FleetShip[] = memberShips.map(s => {
      const cat = enrich(s.shipName);
      return {
        id: s.id,
        shipName: s.shipName,
        customName: s.customName,
        role: s.shipRole ?? cat?.role,
        size: s.shipSize ?? cat?.size,
        manufacturer: s.shipManufacturer ?? cat?.manufacturer,
        status: s.status,
        condition: s.condition,
        location: s.location,
        ownership: 'member' as const,
        ownerName: s.ownerName || s.username || 'Unknown Member',
        sharingLevel: s.sharingLevel,
        isAvailable: s.status !== 'loaned' && s.status !== 'destroyed',
      };
    });
    return [...orgFleetShips, ...memberFleetShips];
  }, [orgShips, memberShips, catalogueLookup]);

  // Dynamic member options derived from member-owned ships in the combined fleet
  const orgMemberOptions = useMemo((): Array<{ value: string; label: string }> => {
    const base: Array<{ value: string; label: string }> = [{ value: 'all', label: 'All Members' }];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const ship of combinedFleet) {
      if (ship.ownership === 'member' && ship.ownerName && !seen.has(ship.ownerName)) {
        seen.add(ship.ownerName);
        names.push(ship.ownerName);
      }
    }
    names.sort((a, b) => a.localeCompare(b));
    return [...base, ...names.map(n => ({ value: n, label: n }))];
  }, [combinedFleet]);

  const totalFleet = combinedFleet.length;

  // Derived loan lists from member ships + org ships
  const activeLoans = [
    ...memberShips.filter(s => s.status === 'loaned'),
    ...orgShips.filter(s => s.status === 'loaned'),
  ];
  const availableForLoan = memberShips.filter(
    s =>
      s.status !== 'loaned' && (s.sharingLevel === 'organization' || s.sharingLevel === 'alliance')
  );

  // Fetch past loan records from ShipLoan history API
  const { data: pastLoansRaw } = useQuery({
    queryKey: [...organizationKeys.detail(orgId ?? ''), 'loan-history', 'returned'],
    queryFn: () => shipLoanService.getOrgLoanHistory(orgId!, 'returned'),
    enabled: !!orgId,
  });
  const pastLoanRecords = pastLoansRaw?.data ?? [];

  // Loan mutations
  const loanOrgShipMutation = useLoanOrgShip();
  const returnOrgShipLoanMutation = useReturnOrgShipLoan();

  const refreshing = refreshingOrg || refreshingMember;
  const orgError = (() => {
    if (!orgQueryError) return null;
    return orgQueryError instanceof Error
      ? orgQueryError.message
      : 'Failed to load organization ships';
  })();
  const memberError = (() => {
    if (!memberQueryError) return null;
    return memberQueryError instanceof Error
      ? memberQueryError.message
      : 'Failed to load member-shared ships';
  })();

  /* ---- Add / Import handlers ---- */
  const handleAddShip = async (shipData: Record<string, unknown>) => {
    if (!orgId) throw new Error('No organization selected');
    try {
      await organizationShipService.createOrgShip(orgId, shipData as unknown as CreateOrgShipInput);
      queryClient.invalidateQueries({ queryKey: organizationKeys.ships(orgId) });
      notification.success('Ship added to org fleet');
    } catch (err) {
      logger.error('Failed to add org ship', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  const handleImportShips = async (ships: Record<string, unknown>[]) => {
    if (!orgId) throw new Error('No organization selected');
    const results = await Promise.allSettled(
      ships.map(shipData =>
        organizationShipService.createOrgShip(orgId, shipData as unknown as CreateOrgShipInput)
      )
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    queryClient.invalidateQueries({ queryKey: organizationKeys.ships(orgId) });
    if (failed > 0) {
      notification.error(`Imported ${succeeded} ships, ${failed} failed`);
      throw new Error(`${failed} of ${ships.length} ships failed to import`);
    }
    notification.success(`${succeeded} ships imported to org fleet`);
  };

  const handleRefresh = () => {
    if (!orgId) return;
    queryClient.invalidateQueries({ queryKey: organizationKeys.ships(orgId) });
  };

  /* ---- Columns: combined fleet ---- */
  const fleetColumns: DataTableColumn<FleetShip>[] = [
    { key: 'shipName', header: 'Ship Name' },
    { key: 'customName', header: 'Name', render: s => s.customName || '-' },
    {
      key: 'role',
      header: 'Fleet',
      render: s => {
        const fleetNames = shipNameToFleets.get((s.shipName ?? '').toLowerCase());
        return fleetNames && fleetNames.length > 0 ? (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {fleetNames.map(name => (
              <Chip
                key={name}
                label={name}
                size="small"
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.13),
                  color: theme.palette.primary.light,
                  fontWeight: 500,
                }}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: s => (
        <Box
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.875rem',
            background: getStatusBgColor(s.status, theme),
            display: 'inline-block',
          }}
        >
          {s.status}
        </Box>
      ),
    },
    {
      key: 'condition',
      header: 'Condition',
      render: s => (
        <Box
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.875rem',
            background: getConditionBgColor(s.condition, theme),
            display: 'inline-block',
          }}
        >
          {s.condition}
        </Box>
      ),
    },
    { key: 'location', header: 'Location', render: s => s.location || 'Unknown' },
    {
      key: 'isCapital',
      header: 'Capital',
      render: s => (s.isCapital ? <Chip label="Capital" color="warning" size="small" /> : '-'),
    },
    {
      key: 'ownerName' as keyof FleetShip,
      header: 'Owner',
      render: s => (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {s.ownership === 'org' ? (
            <GroupsIcon sx={{ fontSize: '1rem', color: 'info.main' }} />
          ) : (
            <PersonIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
          )}
          <span>{s.ownerName || (s.ownership === 'org' ? 'Organization' : 'Member')}</span>
        </Stack>
      ),
    },
    {
      key: 'isAvailable',
      header: 'Available',
      render: s => (
        <Chip
          label={s.isAvailable ? 'Yes' : 'No'}
          color={s.isAvailable ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      key: 'actions' as keyof FleetShip,
      header: 'Actions',
      render: s => {
        if (s.ownership !== 'org') return null;
        return (
          <Stack direction="row" spacing={0.5}>
            {s.status === 'loaned' ? (
              <Tooltip title="Return ship">
                <IconButton
                  size="small"
                  aria-label="Return ship"
                  onClick={e => {
                    e.stopPropagation();
                    if (!orgId) return;
                    returnOrgShipLoanMutation.mutate(
                      { orgId, shipId: s.id },
                      {
                        onSuccess: () => notification.success('Ship returned'),
                        onError: () => notification.error('Failed to return ship'),
                      }
                    );
                  }}
                >
                  <ReplyIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Loan ship">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Loan ship"
                    disabled={!s.isAvailable}
                    onClick={e => {
                      e.stopPropagation();
                      setLoanShip(s);
                      setLoanBorrowerId('');
                      setLoanPurpose('');
                      setLoanError(null);
                      setLoanDialogOpen(true);
                    }}
                  >
                    <HandshakeIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
  ];

  /* ---- Columns: member-shared ships ---- */
  const memberColumns: DataTableColumn<MemberShip>[] = [
    { key: 'shipName', header: 'Ship Name' },
    { key: 'customName', header: 'Custom Name', render: s => s.customName || '-' },
    {
      key: 'ownerName',
      header: 'Owner',
      render: s => (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <PersonIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
          <span>{s.ownerName || s.username || 'Unknown'}</span>
        </Stack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: s => (
        <Box
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.875rem',
            background: getStatusBgColor(s.status, theme),
            display: 'inline-block',
          }}
        >
          {s.status}
        </Box>
      ),
    },
    {
      key: 'condition',
      header: 'Condition',
      render: s => (
        <Box
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.875rem',
            background: getConditionBgColor(s.condition, theme),
            display: 'inline-block',
          }}
        >
          {s.condition}
        </Box>
      ),
    },
    { key: 'location', header: 'Location', render: s => s.location || 'Unknown' },
    {
      key: 'sharingLevel',
      header: 'Shared As',
      render: s => {
        const sharingLabels: Record<string, string> = {
          organization: 'Org',
          alliance: 'Alliance',
          public: 'Public',
        };
        const label = sharingLabels[s.sharingLevel] ?? s.sharingLevel;
        return <Chip label={label} size="small" color="info" variant="outlined" />;
      },
    },
  ];

  /* ---- Filtered combined fleet ---- */
  const filteredFleet = useMemo(() => {
    const matchesFleetFilter = (ship: FleetShip): boolean => {
      if (filterFleet === 'all') return true;
      const fleets = shipNameToFleets.get((ship.shipName ?? '').toLowerCase());
      return fleets?.includes(filterFleet) ?? false;
    };
    return combinedFleet.filter(ship => {
      // Ownership filter
      if (filterOwnership !== 'all' && ship.ownership !== filterOwnership) return false;
      // Search filter (use debounced value for consistency with data loading)
      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase();
        const matchesSearch =
          (ship.shipName || '').toLowerCase().includes(term) ||
          (ship.customName || '').toLowerCase().includes(term) ||
          (ship.manufacturer || '').toLowerCase().includes(term) ||
          (ship.ownerName || '').toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }
      // Role filter (case-insensitive, skip ships without role data)
      if (filterRole !== 'all') {
        if (ship.role?.toLowerCase() !== filterRole.toLowerCase()) return false;
      }
      // Size filter (case-insensitive, skip ships without size data)
      if (filterSize !== 'all') {
        if (ship.size?.toLowerCase() !== filterSize.toLowerCase()) return false;
      }
      // Fleet filter — ship must be assigned to the selected fleet
      if (!matchesFleetFilter(ship)) return false;
      // Member filter — ship must be owned/shared by the selected member
      if (filterMemberOwner !== 'all' && ship.ownerName !== filterMemberOwner) return false;
      return true;
    });
  }, [
    combinedFleet,
    filterOwnership,
    debouncedSearch,
    filterRole,
    filterSize,
    filterFleet,
    filterMemberOwner,
    shipNameToFleets,
  ]);

  const roleGroups = filteredFleet.reduce<Record<string, FleetShip[]>>((acc, ship) => {
    const role = ship.role || 'unassigned';
    if (!acc[role]) acc[role] = [];
    acc[role].push(ship);
    return acc;
  }, {});

  /* ---- No org fallback ---- */
  if (!orgId) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning">
          You are not currently a member of any organization. Join an organization to view fleet
          assets.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="column" gap={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h4" component="h1">
              Fleet Operations
            </Typography>
            <HelpTooltip
              content="View organization-owned ships and member ships shared with the org. Use the search bar to find ships by name, custom name, manufacturer, or owner. Filter by Role (Fighter, Bomber, Transport, etc.), Size (Small through Capital), or Ownership (Org-Owned vs Member-Owned) using the dropdown menus. Distribution charts show breakdowns by career, role, size, and ownership with color-coded legends below each chart. Click the Fleet Statistics header to collapse or expand the breakdowns and charts. Use the tabs to switch between org fleet, member contributions, and loans."
              icon
              iconSize="sm"
              position="right"
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            {canManageShips && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setIsAddDialogOpen(true)}
              >
                Add Ship
              </Button>
            )}
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh}>
              Refresh
            </Button>
          </Stack>
        </Stack>

        {/* Stats Row */}
        <Stack direction="row" gap={4} flexWrap="wrap">
          <Box
            sx={{ backgroundColor: alpha(theme.palette.common.white, 0.05), p: 2, borderRadius: 1 }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Total Fleet
            </Typography>
            <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: 'success.main' }}>
              {totalFleet}
            </Typography>
          </Box>
          <Box
            sx={{ backgroundColor: alpha(theme.palette.common.white, 0.05), p: 2, borderRadius: 1 }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Org Ships
            </Typography>
            <Typography sx={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalOrgShips}</Typography>
          </Box>
          <Box
            sx={{ backgroundColor: alpha(theme.palette.common.white, 0.05), p: 2, borderRadius: 1 }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Member Shared
            </Typography>
            <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: 'info.main' }}>
              {totalMemberShips}
            </Typography>
          </Box>
          <Box
            sx={{ backgroundColor: alpha(theme.palette.common.white, 0.05), p: 2, borderRadius: 1 }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Divisions
            </Typography>
            <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: 'warning.main' }}>
              {Object.keys(roleGroups).length}
            </Typography>
          </Box>
        </Stack>

        {/* Collapsible Breakdown & Charts */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          role="button"
          tabIndex={0}
          aria-expanded={statsOpen}
          aria-label={statsOpen ? 'Collapse fleet statistics' : 'Expand fleet statistics'}
          onClick={() => setStatsOpen(prev => !prev)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setStatsOpen(prev => !prev);
            }
          }}
          sx={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Fleet Statistics
          </Typography>
          {statsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Stack>
        <Collapse in={statsOpen} timeout="auto">
          <Stack direction="column" gap={3}>
            {/* Breakdown Stats */}
            {fleetStats && (
              <FleetBreakdownPanel
                data={{
                  byRole: fleetStats.ships.byRole,
                  bySize: fleetStats.ships.bySize,
                  byCareer: fleetStats.ships.byCareer,
                  byManufacturer: fleetStats.ships.byManufacturer,
                }}
                onRoleFilter={role => setFilterRole(prev => (prev === role ? 'all' : role))}
                onSizeFilter={size => setFilterSize(prev => (prev === size ? 'all' : size))}
              />
            )}

            {/* Ship Distribution Charts */}
            {fleetStats && (
              <ShipDistributionCharts
                summary={{
                  byCareer: fleetStats.ships.byCareer,
                  byRole: fleetStats.ships.byRole,
                  bySize: fleetStats.ships.bySize,
                }}
              />
            )}

            {/* Ownership Breakdown Chart */}
            {(totalOrgShips > 0 || totalMemberShips > 0) &&
              (() => {
                const ownershipData = [
                  { name: 'Org Owned', value: totalOrgShips, fill: theme.palette.info.main },
                  {
                    name: 'Member Owned',
                    value: totalMemberShips,
                    fill: theme.palette.success.main,
                  },
                ].filter(d => d.value > 0);
                return (
                  <Stack direction="row" gap={2} flexWrap="wrap" alignItems="flex-start">
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
                          Ownership Breakdown
                        </Typography>
                        <Box sx={{ width: '100%', height: 180 }}>
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                            minWidth={100}
                            minHeight={100}
                          >
                            <PieChart>
                              <Pie
                                data={ownershipData}
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
                        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                          {ownershipData.map(entry => (
                            <Box
                              key={entry.name}
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
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
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {entry.name}
                                <Box
                                  component="span"
                                  sx={{ fontWeight: 600, ml: 0.5, color: 'text.primary' }}
                                >
                                  {entry.value}
                                </Box>
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Stack>
                );
              })()}
          </Stack>
        </Collapse>

        <Divider />

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} aria-label="Fleet tabs">
          <Tab
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <GroupsIcon sx={{ fontSize: '1.2rem' }} />
                <span>Org Fleet ({totalFleet})</span>
              </Stack>
            }
          />
          <Tab
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <PersonIcon sx={{ fontSize: '1.2rem' }} />
                <span>Member Ships ({totalMemberShips})</span>
              </Stack>
            }
          />
          <Tab
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <HandshakeIcon sx={{ fontSize: '1.2rem' }} />
                <span>Loans ({activeLoans.length})</span>
              </Stack>
            }
          />
        </Tabs>

        {refreshing && <LinearProgress />}

        {/* Tab 0: Org Ships */}
        {activeTab === 0 && (
          <Stack gap={2}>
            {/* Filters row */}
            <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
              <FilterListIcon sx={{ color: 'text.secondary' }} />
              <TextField
                size="small"
                placeholder="Search ships..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  updateFilters({ search: e.target.value });
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
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  label="Role"
                  value={filterRole}
                  onChange={e => setFilterRole(e.target.value)}
                >
                  {roleOptions.map(r => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Size</InputLabel>
                <Select
                  label="Size"
                  value={filterSize}
                  onChange={e => setFilterSize(e.target.value)}
                >
                  {sizeOptions.map(s => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Ownership</InputLabel>
                <Select<'all' | 'org' | 'member'>
                  label="Ownership"
                  value={filterOwnership}
                  onChange={e => setFilterOwnership(e.target.value)}
                >
                  <MenuItem value="all">All Ships</MenuItem>
                  <MenuItem value="org">Org-Owned</MenuItem>
                  <MenuItem value="member">Member-Owned</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Fleet</InputLabel>
                <Select
                  label="Fleet"
                  value={filterFleet}
                  onChange={e => updateFilters({ fleet: e.target.value })}
                >
                  {orgFleetOptions.map(f => (
                    <MenuItem key={f.value} value={f.value}>
                      {f.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Member</InputLabel>
                <Select
                  label="Member"
                  value={filterMemberOwner}
                  onChange={e => updateFilters({ memberOwner: e.target.value })}
                >
                  {orgMemberOptions.map(m => (
                    <MenuItem key={m.value} value={m.value}>
                      {m.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {(loadingOrg || loadingMember) && <LoadingSpinner />}
            {!loadingOrg && !loadingMember && (orgError || memberError) && (
              <ErrorMessage message={orgError || memberError || 'Failed to load fleet'} />
            )}
            {!loadingOrg && !loadingMember && !orgError && !memberError && (
              <DataTable<FleetShip>
                columns={fleetColumns}
                data={filteredFleet}
                getRowKey={s => s.id}
                emptyMessage="No fleet ships found. Add ships to the org fleet or have members share their ships."
                size="small"
                sortable
                paginated
                pageSize={25}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            )}
          </Stack>
        )}

        {/* Tab 1: Member-Shared Ships */}
        {activeTab === 1 && (
          <Stack gap={2}>
            <Alert severity="info" variant="outlined">
              These ships are owned by individual members who have marked them as shared with the
              organization. They may be available for org operations at the owner&apos;s discretion.
            </Alert>

            {loadingMember && <LoadingSpinner />}
            {!loadingMember && memberError && <ErrorMessage message={memberError} />}
            {!loadingMember && !memberError && (
              <DataTable<MemberShip>
                columns={memberColumns}
                data={memberShips}
                getRowKey={s => s.id}
                emptyMessage="No member ships shared with the organization yet. Members can share ships from their Personal Hangar."
                size="small"
                sortable
                paginated
                pageSize={memberPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                totalCount={totalMemberShips}
                page={memberPage - 1}
                onPageChange={(newPage, newPageSize) => {
                  setMemberPage(newPage + 1);
                  setMemberPageSize(newPageSize);
                }}
              />
            )}
          </Stack>
        )}

        {/* Tab 2: Loans */}
        {activeTab === 2 && (
          <Stack gap={2}>
            {/* Loans sub-tabs */}
            <Tabs
              value={loansSubTab}
              onChange={(_, v) => setLoansSubTab(v)}
              aria-label="Loans sub-tabs"
              sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
            >
              <Tab label={`Active Loans (${activeLoans.length})`} />
              <Tab label={`Available for Loan (${availableForLoan.length})`} />
              <Tab
                label={
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <HistoryIcon sx={{ fontSize: '1rem' }} />
                    <span>Past Loans</span>
                  </Stack>
                }
              />
            </Tabs>

            {/* Active Loans */}
            {loansSubTab === 0 && (
              <Stack gap={2}>
                <Alert severity="info" variant="outlined">
                  Ships currently on loan from both the org fleet and member hangars.
                </Alert>
                {activeLoans.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    No ships are currently on loan.
                  </Typography>
                ) : (
                  <DataTable<OrgShip | MemberShip>
                    columns={[
                      { key: 'shipName', header: 'Ship Name' },
                      {
                        key: 'customName' as keyof (OrgShip | MemberShip),
                        header: 'Name',
                        render: s => s.customName || '-',
                      },
                      {
                        key: 'status',
                        header: 'Status',
                        render: _s => <Chip label="On Loan" color="warning" size="small" />,
                      },
                      { key: 'condition', header: 'Condition', render: s => s.condition },
                      {
                        key: 'location' as keyof (OrgShip | MemberShip),
                        header: 'Location',
                        render: s => s.location || 'Unknown',
                      },
                      {
                        key: 'ownerName' as keyof (OrgShip | MemberShip),
                        header: 'Owner',
                        render: s => {
                          const ms = s as MemberShip;
                          return ms.ownerName || ms.username || 'Org Fleet';
                        },
                      },
                    ]}
                    data={activeLoans}
                    getRowKey={s => s.id}
                    emptyMessage="No active loans"
                    size="small"
                    sortable
                  />
                )}
              </Stack>
            )}

            {/* Available for Loan */}
            {loansSubTab === 1 && (
              <Stack gap={2}>
                <Alert severity="success" variant="outlined">
                  Member ships that have been made available for loan to the organization. These
                  ship owners have offered their ships for org use.
                </Alert>
                {availableForLoan.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    No ships are currently available for loan. Members can offer ships from their
                    Personal Hangar.
                  </Typography>
                ) : (
                  <DataTable<MemberShip>
                    columns={memberColumns}
                    data={availableForLoan}
                    getRowKey={s => s.id}
                    emptyMessage="No ships available for loan"
                    size="small"
                    sortable
                  />
                )}
              </Stack>
            )}

            {/* Past Loans */}
            {loansSubTab === 2 && (
              <Stack gap={2}>
                <Alert severity="info" variant="outlined">
                  History of previously completed loans with activity details.
                </Alert>
                {pastLoanRecords.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    No past loan records found.
                  </Typography>
                ) : (
                  <DataTable<Record<string, unknown>>
                    columns={[
                      {
                        key: 'shipName',
                        header: 'Ship',
                        render: r => String(r.shipName || r.shipId || '-'),
                      },
                      { key: 'lenderId', header: 'Lender', render: r => String(r.lenderId || '-') },
                      {
                        key: 'borrowerId',
                        header: 'Borrower',
                        render: r => String(r.borrowerId || '-'),
                      },
                      {
                        key: 'scope',
                        header: 'Scope',
                        render: r => (
                          <Chip
                            label={String(r.scope || 'org')}
                            size="small"
                            color={r.scope === 'alliance' ? 'secondary' : 'info'}
                            variant="outlined"
                          />
                        ),
                      },
                      {
                        key: 'activityName',
                        header: 'Activity',
                        render: r => String(r.activityName || '-'),
                      },
                      {
                        key: 'startDate',
                        header: 'Start',
                        render: r =>
                          r.startDate ? new Date(String(r.startDate)).toLocaleDateString() : '-',
                      },
                      {
                        key: 'actualReturnDate',
                        header: 'Returned',
                        render: r =>
                          r.actualReturnDate
                            ? new Date(String(r.actualReturnDate)).toLocaleDateString()
                            : '-',
                      },
                      { key: 'purpose', header: 'Purpose', render: r => String(r.purpose || '-') },
                    ]}
                    data={pastLoanRecords as unknown as Record<string, unknown>[]}
                    getRowKey={r => String(r.id)}
                    emptyMessage="No past loans"
                    size="small"
                    sortable
                  />
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Stack>

      {/* Add Ship Dialog (reuses Personal Hangar catalogue browser) */}
      <AddShipDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAddShip={handleAddShip}
        onImportShips={handleImportShips}
      />

      {/* Loan Ship Dialog */}
      <Dialog
        open={loanDialogOpen}
        onClose={() => {
          setLoanDialogOpen(false);
          setLoanShip(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Loan Ship — {loanShip?.customName || loanShip?.shipName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Borrower User ID"
              fullWidth
              variant="outlined"
              value={loanBorrowerId}
              onChange={e => setLoanBorrowerId(e.target.value)}
              helperText="Enter the user ID of the person borrowing this ship"
            />
            <TextField
              label="Purpose"
              fullWidth
              variant="outlined"
              multiline
              minRows={2}
              value={loanPurpose}
              onChange={e => setLoanPurpose(e.target.value)}
              helperText="Optional: reason for the loan"
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
            disabled={!loanBorrowerId.trim() || !orgId || loanOrgShipMutation.isPending}
            onClick={async () => {
              if (!orgId || !loanShip) return;
              setLoanError(null);
              try {
                await loanOrgShipMutation.mutateAsync({
                  orgId,
                  shipId: loanShip.id,
                  data: {
                    borrowerId: loanBorrowerId.trim(),
                    purpose: loanPurpose.trim() || undefined,
                  },
                });
                setLoanDialogOpen(false);
                setLoanShip(null);
                notification.success('Ship loaned successfully');
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to loan ship';
                setLoanError(message);
              }
            }}
          >
            {loanOrgShipMutation.isPending ? <CircularProgress size={20} /> : 'Loan Ship'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Export both versions for different use cases
export { OrganizationShips };

export const OrganizationShipsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Organization Ships"
    fallbackMessage="Unable to load organization ships. Please try again later."
    showHomeButton={true}
  >
    <OrganizationShips />
  </FeatureErrorBoundary>
);
