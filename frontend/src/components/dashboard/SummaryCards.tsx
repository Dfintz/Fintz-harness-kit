/**
 * SummaryCards — Dashboard summary card wrapper
 *
 * Renders a row of at-a-glance stat cards at the top of the Dashboard.
 * Uses the existing StatCard component with proper responsive wrapping
 * and a SkeletonCard fallback while data loads.
 *
 * Org users can customize which stat cards are visible via a picker dialog.
 *
 * @example
 * <SummaryCards stats={orgStats} loading={isLoading} />
 */

import { SparklineDataPoint, StatCard } from '@/components/StatCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import {
  Handshake as AllianceIcon,
  EmojiEvents as BountyIcon,
  Campaign,
  ViewList as FleetIcon,
  Inventory2 as InventoryIcon,
  Group as MembersIcon,
  // Terrain as MiningIcon, // Standalone mining disabled
  Assignment as MissionsIcon,
  Shield as ReputationIcon,
  RocketLaunch as ShipsIcon,
  TrendingUp as TradingIcon,
} from '@mui/icons-material';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

export interface SummaryCardItem {
  /** Card label */
  label: string;
  /** Primary value */
  value: string | number;
  /** Subtitle text */
  subtitle?: string;
  /** Accent colour */
  color?: string;
  /** MUI icon component */
  icon?: React.ComponentType;
  /** Sparkline data points */
  sparklineData?: SparklineDataPoint[];
  /** Previous period value for trend comparison */
  previousValue?: number;
}

export interface SummaryCardsProps {
  /** Show loading skeletons */
  loading?: boolean;
  /** Custom stat items (overrides built-in org/personal stats) */
  items?: SummaryCardItem[];
  /* ---- Org stats (used when items is not provided) ---- */
  memberCount?: number;
  fleetCount?: number;
  shipCount?: number;
  sharedShipCount?: number;
  personalShipCount?: number;
  activityCount?: number;
  upcomingActivities?: number;
  /* ---- Dashboard expansion stats (16-C/D/E/F) ---- */
  tradingActiveRoutes?: number;
  tradingEstimatedProfit?: number;
  inventoryTotalItems?: number;
  inventoryTotalValue?: number;
  // miningActiveOperations?: number; // Standalone mining disabled
  missionCount?: number;
  /* ---- Sprint 21 dashboard domains ---- */
  allianceCount?: number;
  allianceMutual?: number;
  bountyActive?: number;
  bountyTotal?: number;
  reputationScore?: number;
  reputationReliability?: string;
}

/** Simple seeded PRNG for deterministic sparkline mock data (non-cryptographic, display-only) */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

/** Generate simple mock sparkline data that trends from previous toward current */
function mockSparkline(
  current: number,
  previous?: number,
  points = 7,
  vol = 0.15
): SparklineDataPoint[] {
  const data: SparklineDataPoint[] = [];
  const start = previous ?? current;
  const rng = seededRandom(current + points);
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1); // 0 → 1
    const base = start + (current - start) * t;
    const noise = base * vol * (rng() - 0.5);
    data.push({ x: i, y: Math.max(0, Math.round(base + noise)) });
  }
  // Ensure endpoints are exact
  data[0].y = start;
  data.at(-1)!.y = current;
  return data;
}

// ---------------------------------------------------------------------------
// Summary card visibility preferences (persisted to localStorage)
// ---------------------------------------------------------------------------
const SUMMARY_CARDS_STORAGE_KEY = 'dashboard-summary-cards-visible';
const ALL_ORG_CARD_LABELS = [
  'Members',
  'Fleets',
  'Ships',
  'Activities',
  'Trading Routes',
  'Inventory',
  'Missions',
  'Alliances',
  'Bounties',
  'Reputation',
];

function loadVisibleCards(): Set<string> {
  try {
    const stored = localStorage.getItem(SUMMARY_CARDS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return new Set(parsed.filter(l => ALL_ORG_CARD_LABELS.includes(l)));
      }
    }
  } catch {
    /* ignore */
  }
  return new Set(ALL_ORG_CARD_LABELS); // all visible by default
}

// ---------------------------------------------------------------------------
// Summary Card Picker Dialog
// ---------------------------------------------------------------------------
interface SummaryCardPickerProps {
  open: boolean;
  onClose: () => void;
  visible: Set<string>;
  onSave: (labels: Set<string>) => void;
}

const CARD_ICONS: Record<string, React.ReactNode> = {
  Members: <MembersIcon fontSize="small" />,
  Fleets: <FleetIcon fontSize="small" />,
  Ships: <ShipsIcon fontSize="small" />,
  Activities: <Campaign fontSize="small" />,
  'Trading Routes': <TradingIcon fontSize="small" />,
  Inventory: <InventoryIcon fontSize="small" />,
  Missions: <MissionsIcon fontSize="small" />,
  Alliances: <AllianceIcon fontSize="small" />,
  Bounties: <BountyIcon fontSize="small" />,
  Reputation: <ReputationIcon fontSize="small" />,
};

const SummaryCardPicker: React.FC<SummaryCardPickerProps> = ({
  open,
  onClose,
  visible,
  onSave,
}) => {
  const [draft, setDraft] = useState<Set<string>>(visible);

  React.useEffect(() => {
    if (open) setDraft(new Set(visible));
  }, [open, visible]);

  const toggle = (label: string) => {
    setDraft(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        if (next.size <= 1) return next; // keep at least 1
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Choose Summary Cards</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 2, pt: 1, display: 'block' }}
        >
          Select which stat cards to show on the dashboard. At least one must be visible.
        </Typography>
        <List dense>
          {ALL_ORG_CARD_LABELS.map(label => {
            const checked = draft.has(label);
            return (
              <ListItemButton key={label} onClick={() => toggle(label)} dense>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={checked}
                    tabIndex={-1}
                    disableRipple
                    size="small"
                  />
                </ListItemIcon>
                <ListItemIcon sx={{ minWidth: 32 }}>{CARD_ICONS[label]}</ListItemIcon>
                <ListItemText primary={label} />
              </ListItemButton>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={() => setDraft(new Set(ALL_ORG_CARD_LABELS))}>
          Show All
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={draft.size === 0}
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
// Main component
// ---------------------------------------------------------------------------

const SummaryCards: React.FC<SummaryCardsProps> = ({
  loading = false,
  items,
  memberCount = 0,
  fleetCount = 0,
  shipCount = 0,
  sharedShipCount = 0,
  personalShipCount,
  activityCount = 0,
  upcomingActivities = 0,
  tradingActiveRoutes = 0,
  tradingEstimatedProfit = 0,
  inventoryTotalItems = 0,
  inventoryTotalValue = 0,
  // miningActiveOperations = 0, // Standalone mining disabled
  missionCount = 0,
  allianceCount = 0,
  allianceMutual = 0,
  bountyActive = 0,
  bountyTotal = 0,
  reputationScore = 0,
  reputationReliability = '',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [visibleCards, setVisibleCards] = useState<Set<string>>(loadVisibleCards);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSaveVisible = useCallback((labels: Set<string>) => {
    setVisibleCards(labels);
    try {
      localStorage.setItem(SUMMARY_CARDS_STORAGE_KEY, JSON.stringify([...labels]));
    } catch {
      /* quota exceeded */
    }
  }, []);

  if (loading) {
    return <SkeletonCard count={isMobile ? 2 : 4} variant="stat" />;
  }

  // Custom items bypass the card picker (used for solo/personal mode)
  if (items) {
    return (
      <Box sx={{ mt: 2 }}>
        <Stack
          direction="row"
          gap={{ xs: 1.5, sm: 2, md: 3 }}
          flexWrap="wrap"
          sx={{
            '& > *': {
              flex: { xs: '1 1 calc(50% - 12px)', sm: '1 1 160px' },
              minWidth: 0,
            },
          }}
        >
          {items.map(card => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon as React.ComponentType}
              color={card.color}
              sparklineData={card.sparklineData}
              previousValue={card.previousValue}
              comparisonPeriod="week"
            />
          ))}
        </Stack>
      </Box>
    );
  }

  const allCards: SummaryCardItem[] = [
    {
      label: 'Members',
      value: memberCount,
      subtitle: 'Active members',
      color: theme.palette.primary.main,
      icon: MembersIcon,
      sparklineData: mockSparkline(memberCount, Math.round(memberCount * 0.92)),
      previousValue: Math.round(memberCount * 0.92),
    },
    {
      label: 'Fleets',
      value: fleetCount,
      subtitle: `${sharedShipCount} shared ships`,
      color: theme.palette.success.main,
      icon: FleetIcon,
      sparklineData: mockSparkline(fleetCount, Math.round(fleetCount * 0.88)),
      previousValue: Math.round(fleetCount * 0.88),
    },
    {
      label: 'Ships',
      value: personalShipCount ?? shipCount,
      subtitle: personalShipCount != null ? `${shipCount} org fleet` : 'Fleet assets',
      color: theme.palette.warning.main,
      icon: ShipsIcon,
      sparklineData: mockSparkline(shipCount, Math.round(shipCount * 0.9)),
      previousValue: Math.round(shipCount * 0.9),
    },
    {
      label: 'Activities',
      value: activityCount,
      subtitle: `${upcomingActivities} upcoming`,
      color: theme.palette.error.main,
      icon: Campaign,
      sparklineData: mockSparkline(activityCount, Math.round(activityCount * 0.78)),
      previousValue: Math.round(activityCount * 0.78),
    },
    {
      label: 'Trading Routes',
      value: tradingActiveRoutes,
      subtitle: `~${tradingEstimatedProfit.toLocaleString()} aUEC profit`,
      color: theme.palette.success.main,
      icon: TradingIcon,
      sparklineData: mockSparkline(tradingActiveRoutes, Math.round(tradingActiveRoutes * 0.85)),
      previousValue: Math.round(tradingActiveRoutes * 0.85),
    },
    {
      label: 'Inventory',
      value: inventoryTotalItems,
      subtitle: `${inventoryTotalValue.toLocaleString()} aUEC value`,
      color: theme.palette.info.main,
      icon: InventoryIcon,
      sparklineData: mockSparkline(inventoryTotalItems, Math.round(inventoryTotalItems * 0.9)),
      previousValue: Math.round(inventoryTotalItems * 0.9),
    },
    {
      label: 'Missions',
      value: missionCount,
      subtitle: 'Total missions',
      color: theme.palette.error.main,
      icon: MissionsIcon,
      sparklineData: mockSparkline(missionCount, Math.round(missionCount * 0.82)),
      previousValue: Math.round(missionCount * 0.82),
    },
    {
      label: 'Alliances',
      value: allianceCount,
      subtitle: `${allianceMutual} mutual`,
      color: theme.palette.secondary.main,
      icon: AllianceIcon,
      sparklineData: mockSparkline(allianceCount, Math.round(allianceCount * 0.9)),
      previousValue: Math.round(allianceCount * 0.9),
    },
    {
      label: 'Bounties',
      value: bountyActive,
      subtitle: `${bountyTotal} total posted`,
      color: theme.palette.warning.main,
      icon: BountyIcon,
      sparklineData: mockSparkline(bountyActive, Math.round(bountyActive * 0.85)),
      previousValue: Math.round(bountyActive * 0.85),
    },
    {
      label: 'Reputation',
      value: reputationScore,
      subtitle: reputationReliability || 'Not rated',
      color: theme.palette.info.main,
      icon: ReputationIcon,
      sparklineData: mockSparkline(reputationScore, Math.round(reputationScore * 0.95)),
      previousValue: Math.round(reputationScore * 0.95),
    },
  ];

  // Filter to only visible cards
  const cards = allCards.filter(c => visibleCards.has(c.label));

  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.5, mt: -1 }}>
        <Tooltip title="Choose which stat cards to show">
          <IconButton
            size="small"
            onClick={() => setPickerOpen(true)}
            aria-label="Customize summary cards"
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack
        direction="row"
        gap={{ xs: 1.5, sm: 2, md: 3 }}
        flexWrap="wrap"
        sx={{
          '& > *': {
            flex: { xs: '1 1 calc(50% - 12px)', sm: '1 1 160px' },
            minWidth: 0,
          },
        }}
      >
        {cards.map(card => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            subtitle={card.subtitle}
            icon={
              card.icon as React.ComponentType<{
                size?: 'S' | 'M' | 'L' | 'XL';
                UNSAFE_className?: string;
                UNSAFE_style?: React.CSSProperties;
              }>
            }
            color={card.color}
            sparklineData={card.sparklineData}
            previousValue={card.previousValue}
            comparisonPeriod="week"
          />
        ))}
      </Stack>
      <SummaryCardPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        visible={visibleCards}
        onSave={handleSaveVisible}
      />
    </Box>
  );
};

export { SummaryCards };
