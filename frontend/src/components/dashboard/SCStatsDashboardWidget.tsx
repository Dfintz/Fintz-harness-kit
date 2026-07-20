/**
 * SCStatsDashboardWidget — compact SCStats summary for the main Dashboard.
 *
 * For org users: shows org-wide summary (avg K/D, avg hours, verification %, top performer).
 * For solo users: shows personal gameplay metrics with user-configurable stat slots.
 *
 * Uses the React Query hooks from useSCStatsQueries for caching & background refetch.
 * Personal stats are sourced from CSV import (preferred) with JSON fallback.
 */
import FlightIcon from '@mui/icons-material/Flight';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SettingsIcon from '@mui/icons-material/Settings';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TimerIcon from '@mui/icons-material/Timer';
import VerifiedIcon from '@mui/icons-material/Verified';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';

import {
  useSCStatsCsvData,
  useSCStatsData,
  useSCStatsOrgAnalytics,
} from '@/hooks/queries/useSCStatsQueries';
import { shipCatalogueService } from '@/services/shipCatalogueService';
import type { SCStatsCsvSummary, SCStatsMetrics } from '@sc-fleet-manager/shared-types';

// ---------------------------------------------------------------------------
// Stat card (reusable within this widget)
// ---------------------------------------------------------------------------
interface MiniStatProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const MiniStat: React.FC<MiniStatProps> = ({ label, value, icon, color }) => (
  <Box
    sx={{
      textAlign: 'center',
      p: 1.5,
      borderRadius: 2,
      bgcolor: 'action.hover',
    }}
  >
    <Box sx={{ color, mb: 0.5 }}>{icon}</Box>
    <Typography variant="h6" fontWeight={700}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Box>
);

// ---------------------------------------------------------------------------
// Org variant
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Org variant — stat definitions & picker
// ---------------------------------------------------------------------------

interface OrgStatDefinition {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  getValue: (analytics: import('@sc-fleet-manager/shared-types').OrgSCStatsAnalytics) => string;
}

const ALL_ORG_STATS: OrgStatDefinition[] = [
  {
    key: 'avgKD',
    label: 'Avg K/D',
    icon: <GpsFixedIcon />,
    color: 'error.light',
    getValue: a => (a.averageKD == null ? '—' : a.averageKD.toFixed(2)),
  },
  {
    key: 'avgHours',
    label: 'Avg Hours',
    icon: <TimerIcon />,
    color: 'primary.main',
    getValue: a => (a.averageTotalHours == null ? '—' : `${a.averageTotalHours.toFixed(0)}h`),
  },
  {
    key: 'avgMissions',
    label: 'Avg Missions',
    icon: <MilitaryTechIcon />,
    color: 'warning.light',
    getValue: a =>
      a.averageMissionsCompleted == null ? '—' : a.averageMissionsCompleted.toFixed(0),
  },
  {
    key: 'verified',
    label: 'Verified',
    icon: <VerifiedIcon />,
    color: 'success.light',
    getValue: a => `${a.verifiedCount}/${a.memberCount}`,
  },
  {
    key: 'verificationRate',
    label: 'Verification %',
    icon: <VerifiedIcon />,
    color: 'success.main',
    getValue: a => (a.verificationRate == null ? '—' : `${a.verificationRate.toFixed(0)}%`),
  },
  {
    key: 'memberCount',
    label: 'Members',
    icon: <SportsEsportsIcon />,
    color: 'primary.light',
    getValue: a => String(a.memberCount),
  },
  {
    key: 'topKD',
    label: 'Top K/D',
    icon: <GpsFixedIcon />,
    color: 'error.main',
    getValue: a => {
      const top = a.topPerformers?.[0];
      return top ? top.kdRatio.toFixed(2) : '—';
    },
  },
  {
    key: 'topHours',
    label: 'Top Hours',
    icon: <TimerIcon />,
    color: 'secondary.light',
    getValue: a => {
      const top = a.topPerformers?.[0];
      return top ? `${top.totalHours.toFixed(0)}h` : '—';
    },
  },
];

const DEFAULT_ORG_STATS = ['avgKD', 'avgHours', 'avgMissions', 'verified'];
const ORG_STATS_STORAGE_KEY = 'scstats-org-widget-selected';

function loadOrgSelectedStats(): string[] {
  try {
    const stored = localStorage.getItem(ORG_STATS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= MAX_STATS) {
        const validKeys = new Set(ALL_ORG_STATS.map(s => s.key));
        const valid = parsed.filter(k => validKeys.has(k));
        if (valid.length > 0) return valid;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ORG_STATS;
}

interface OrgSCStatsWidgetProps {
  organizationId: string;
}

const OrgSCStatsWidget: React.FC<OrgSCStatsWidgetProps> = ({ organizationId }) => {
  const {
    data: analytics,
    isLoading,
    error,
  } = useSCStatsOrgAnalytics(organizationId, {
    staleTime: 5 * 60_000,
  });

  const [selectedKeys, setSelectedKeys] = useState<string[]>(loadOrgSelectedStats);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSaveStats = useCallback((keys: string[]) => {
    setSelectedKeys(keys);
    try {
      localStorage.setItem(ORG_STATS_STORAGE_KEY, JSON.stringify(keys));
    } catch {
      /* quota exceeded */
    }
  }, []);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error || !analytics || analytics.memberCount === 0) {
    return (
      <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
        No SCStats data available yet. Members can import their stats from the Profile page.
      </Alert>
    );
  }

  const activeStats = selectedKeys
    .map(key => ALL_ORG_STATS.find(s => s.key === key))
    .filter((s): s is OrgStatDefinition => !!s);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: -1, mt: -0.5 }}>
        <Tooltip title="Choose which org stats to display">
          <IconButton size="small" onClick={() => setPickerOpen(true)} aria-label="Edit org stats">
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Grid container spacing={2}>
        {activeStats.map(stat => (
          <Grid key={stat.key} size={{ xs: 6, sm: 3 }}>
            <MiniStat
              label={stat.label}
              value={stat.getValue(analytics)}
              icon={stat.icon}
              color={stat.color}
            />
          </Grid>
        ))}
      </Grid>

      {/* Verification progress bar */}
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={analytics.verificationRate}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {analytics.verificationRate == null ? '0' : analytics.verificationRate.toFixed(0)}%
          verified
        </Typography>
      </Stack>

      <StatPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={selectedKeys}
        onSave={handleSaveStats}
        title="Choose Org Stats"
        description={`Select up to ${MAX_STATS} org metrics to display on the dashboard.`}
        stats={ALL_ORG_STATS}
        defaults={DEFAULT_ORG_STATS}
      />
    </Stack>
  );
};

// ---------------------------------------------------------------------------
// Shared Stat Picker Dialog (used for both Org and Personal variants)
// ---------------------------------------------------------------------------
interface StatPickerDialogProps {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onSave: (keys: string[]) => void;
  title: string;
  description: string;
  stats: ReadonlyArray<{ key: string; label: string; color: string; icon: React.ReactNode }>;
  defaults: string[];
}

const StatPickerDialog: React.FC<StatPickerDialogProps> = ({
  open,
  onClose,
  selected,
  onSave,
  title,
  description,
  stats,
  defaults,
}) => {
  const [draft, setDraft] = useState<string[]>(selected);

  React.useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  const toggle = (key: string) => {
    setDraft(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= MAX_STATS) return prev;
      return [...prev, key];
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 2, pt: 1, display: 'block' }}
        >
          {description}
        </Typography>
        <List dense>
          {stats.map(stat => {
            const checked = draft.includes(stat.key);
            const disabled = !checked && draft.length >= MAX_STATS;
            return (
              <ListItemButton
                key={stat.key}
                onClick={() => toggle(stat.key)}
                disabled={disabled}
                dense
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={checked}
                    disabled={disabled}
                    tabIndex={-1}
                    disableRipple
                    size="small"
                  />
                </ListItemIcon>
                <ListItemIcon sx={{ minWidth: 32, color: stat.color }}>{stat.icon}</ListItemIcon>
                <ListItemText primary={stat.label} />
              </ListItemButton>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={() => setDraft(defaults)}>
          Reset
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={draft.length === 0}
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Personal variant — stat definitions & picker
// ---------------------------------------------------------------------------

interface StatDefinition {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  getValue: (
    csv: SCStatsCsvSummary | null | undefined,
    json: SCStatsMetrics | null | undefined,
    resolvedShipName?: string
  ) => string;
}

/** All available stats the user can pick from. */
const ALL_STATS: StatDefinition[] = [
  {
    key: 'totalPlaytime',
    label: 'Total Playtime',
    icon: <TimerIcon />,
    color: 'primary.main',
    getValue: (csv, json) => {
      const hours =
        csv?.totalPlaytimeHours ?? (json?.totalHours == null ? null : Number(json.totalHours));
      return hours == null ? '—' : `${Number(hours).toFixed(1)}h`;
    },
  },
  {
    key: 'mostPlayed',
    label: 'Most Played',
    icon: <SportsEsportsIcon />,
    color: 'secondary.light',
    getValue: csv => csv?.mostPlayedVersion ?? '—',
  },
  {
    key: 'mostFlown',
    label: 'Most Flown',
    icon: <FlightIcon />,
    color: 'success.light',
    getValue: (csv, json, resolvedShipName) =>
      resolvedShipName ||
      csv?.mostFlownShip?.replaceAll('_', ' ') ||
      json?.favoriteVehicle?.replaceAll('_', ' ') ||
      '—',
  },
  {
    key: 'auecSpent',
    label: 'aUEC Spent',
    icon: <MonetizationOnIcon />,
    color: 'warning.main',
    getValue: csv =>
      csv?.totalAuecSpent == null ? '—' : Number(csv.totalAuecSpent).toLocaleString(),
  },
  {
    key: 'kdRatio',
    label: 'K/D Ratio',
    icon: <GpsFixedIcon />,
    color: 'error.light',
    getValue: (_, json) => (json?.kdRatio == null ? '—' : Number(json.kdRatio).toFixed(2)),
  },
  {
    key: 'missions',
    label: 'Missions',
    icon: <MilitaryTechIcon />,
    color: 'warning.light',
    getValue: (_, json) => (json?.missionsCompleted == null ? '—' : String(json.missionsCompleted)),
  },
  {
    key: 'versionsPlayed',
    label: 'Versions Played',
    icon: <SportsEsportsIcon />,
    color: 'secondary.light',
    getValue: csv => (csv?.versionsPlayed == null ? '—' : String(csv.versionsPlayed)),
  },
  {
    key: 'shipsFlown',
    label: 'Ships Flown',
    icon: <RocketLaunchIcon />,
    color: 'error.light',
    getValue: csv => (csv?.totalShipsFlown == null ? '—' : String(csv.totalShipsFlown)),
  },
  {
    key: 'flightTime',
    label: 'Flight Time',
    icon: <FlightIcon />,
    color: 'primary.main',
    getValue: csv =>
      csv?.totalFlightTimeHours == null ? '—' : `${Number(csv.totalFlightTimeHours).toFixed(1)}h`,
  },
  {
    key: 'itemsPurchased',
    label: 'Items Purchased',
    icon: <ShoppingCartIcon />,
    color: 'warning.main',
    getValue: csv => (csv?.uniqueItemsPurchased == null ? '—' : String(csv.uniqueItemsPurchased)),
  },
  {
    key: 'favoriteShop',
    label: 'Favorite Shop',
    icon: <StorefrontIcon />,
    color: 'warning.main',
    getValue: csv => csv?.favoriteShop?.replaceAll('_', ' ') ?? '—',
  },
];

const DEFAULT_SELECTED_STATS = ['totalPlaytime', 'mostPlayed', 'mostFlown', 'auecSpent'];
const MAX_STATS = 4;
const STORAGE_KEY = 'scstats-widget-selected';

function loadSelectedStats(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= MAX_STATS) {
        // Validate that every key still exists
        const validKeys = new Set(ALL_STATS.map(s => s.key));
        const valid = parsed.filter(k => validKeys.has(k));
        if (valid.length > 0) return valid;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULT_SELECTED_STATS;
}

// ---------------------------------------------------------------------------
// Ship catalogue matcher — resolves raw SCStats name to catalogue display name
// ---------------------------------------------------------------------------
function useShipCatalogueMatch(rawName: string | null | undefined) {
  const searchTerm = useMemo(() => {
    if (!rawName) return '';
    const parts = rawName.split('_');
    // Strip manufacturer prefix: "MISC_Prospector" → "Prospector"
    return parts.length > 1 ? parts.slice(1).join(' ') : rawName;
  }, [rawName]);

  return useQuery({
    queryKey: ['ship-catalogue-match', rawName],
    queryFn: async () => {
      const result = await shipCatalogueService.getShips({ search: searchTerm, limit: 10 });
      if (result.items.length > 0) {
        // Try exact match first
        const exact = result.items.find(
          item => item.name.toLowerCase() === searchTerm.toLowerCase()
        );
        if (exact) return exact.name;
        // Try partial match
        const partial = result.items.find(item =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (partial) return partial.name;
      }
      // Fallback: just format with spaces
      return rawName?.replaceAll('_', ' ') ?? null;
    },
    enabled: !!rawName && searchTerm.length > 0,
    staleTime: Infinity,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Personal variant
// ---------------------------------------------------------------------------
interface PersonalSCStatsWidgetProps {
  userId: string;
}

const PersonalSCStatsWidget: React.FC<PersonalSCStatsWidgetProps> = ({ userId }) => {
  // Fetch both CSV and JSON data; CSV is preferred (richer), JSON is fallback
  const { data: csvData, isLoading: csvLoading } = useSCStatsCsvData(userId, {
    staleTime: 5 * 60_000,
  });
  const { data: jsonData, isLoading: jsonLoading } = useSCStatsData(userId, {
    staleTime: 5 * 60_000,
  });

  // Ship catalogue match for mostFlown
  const rawShipName = csvData?.summary?.mostFlownShip ?? jsonData?.metrics?.favoriteVehicle;
  const { data: resolvedShipName } = useShipCatalogueMatch(rawShipName);

  // Stat selection
  const [selectedKeys, setSelectedKeys] = useState<string[]>(loadSelectedStats);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSaveStats = useCallback((keys: string[]) => {
    setSelectedKeys(keys);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch {
      /* quota exceeded — ignore */
    }
  }, []);

  const isLoading = csvLoading && jsonLoading;
  const hasData = csvData?.hasData || jsonData?.hasData;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!hasData) {
    return (
      <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
        No SCStats data imported yet. Import your stats from the Profile page.
      </Alert>
    );
  }

  const csvSummary = csvData?.summary ?? null;
  const jsonMetrics = jsonData?.metrics ?? null;

  // Resolve the active stats in display order
  const activeStats = selectedKeys
    .map(key => ALL_STATS.find(s => s.key === key))
    .filter((s): s is StatDefinition => !!s);

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: -1, mt: -0.5 }}>
        <Tooltip title="Choose which stats to display">
          <IconButton size="small" onClick={() => setPickerOpen(true)} aria-label="Edit stats">
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Grid container spacing={2}>
        {activeStats.map(stat => (
          <Grid key={stat.key} size={{ xs: 6, sm: 3 }}>
            <MiniStat
              label={stat.label}
              value={stat.getValue(
                csvSummary,
                jsonMetrics,
                stat.key === 'mostFlown' ? (resolvedShipName ?? undefined) : undefined
              )}
              icon={stat.icon}
              color={stat.color}
            />
          </Grid>
        ))}
      </Grid>

      <StatPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={selectedKeys}
        onSave={handleSaveStats}
        title="Choose Dashboard Stats"
        description={`Select up to ${MAX_STATS} stats to display on the dashboard.`}
        stats={ALL_STATS}
        defaults={DEFAULT_SELECTED_STATS}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Exported unified widget
// ---------------------------------------------------------------------------
export interface SCStatsDashboardWidgetProps {
  /** Set for org users; shows org-wide analytics. */
  organizationId?: string;
  /** Set for solo users; shows personal stats. */
  userId?: string;
}

export const SCStatsDashboardWidget: React.FC<SCStatsDashboardWidgetProps> = ({
  organizationId,
  userId,
}) => {
  if (organizationId) {
    return <OrgSCStatsWidget organizationId={organizationId} />;
  }
  if (userId) {
    return <PersonalSCStatsWidget userId={userId} />;
  }
  return null;
};
