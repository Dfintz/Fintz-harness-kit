/**
 * SCStats Page
 *
 * Standalone page for Star Citizen gameplay statistics.
 * Shows personal stats card (from CSV import), import dialog,
 * verification badge, and (for org members) organization-level analytics.
 *
 * Sprint 0 — D3: SCStats Shared Types & Standalone Page
 */

import BarChartIcon from '@mui/icons-material/BarChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import TimerIcon from '@mui/icons-material/Timer';
import WorkIcon from '@mui/icons-material/Work';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { PageHeader } from '@/components/PageHeader';
import { SCStatsImportDialog } from '@/components/profile/SCStatsImportDialog';
import { SCStatsOrgDashboard } from '@/components/profile/SCStatsOrgDashboard';
import { useDeleteSCStatsCsv, useSCStatsCsvData } from '@/hooks/queries/useSCStatsQueries';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import type {
  SCStatsCareerHours,
  SCStatsCsvCategoryStatus,
  SCStatsCsvSummary,
} from '@sc-fleet-manager/shared-types';

// ---------------------------------------------------------------------------
// SCStatsPage component
// ---------------------------------------------------------------------------

export const SCStatsPage: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const userId = user?.id;
  const orgId = user?.activeOrgId;

  const { data: csvStats, isLoading, error, refetch } = useSCStatsCsvData(userId);
  const deleteCsv = useDeleteSCStatsCsv(userId ?? '');

  const [importOpen, setImportOpen] = useState(false);

  if (!userId) {
    return (
      <Box sx={{ width: '100%', p: 4 }}>
        <Alert severity="warning">You must be logged in to view SCStats.</Alert>
      </Box>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteCsv.mutateAsync();
      refetch();
    } catch (err) {
      logger.error(
        'Failed to delete SCStats CSV data',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  return (
    <Box sx={{ width: '100%', p: 4 }}>
      <Stack direction="column" gap={3} width="100%">
        <PageHeader
          title="SCStats"
          helpTooltip="Import and view your Star Citizen gameplay statistics from the SCStats desktop app."
          description="Track your combat, missions, and flight hours across Star Citizen"
        />

        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          href="https://github.com/Maple33-hash/SCStats/releases"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ alignSelf: 'flex-start' }}
        >
          Download SCStats App
        </Button>

        {/* ---------- Personal Stats Section ---------- */}
        <Stack direction="row" alignItems="center" gap={2}>
          <BarChartIcon color="primary" />
          <Typography variant="h6">Your Statistics</Typography>
        </Stack>

        {isLoading && <Typography color="text.secondary">Loading stats…</Typography>}

        {error && (
          <Alert severity="error">Failed to load SCStats data. Please try again later.</Alert>
        )}

        {csvStats?.hasData && csvStats.summary && (
          <CsvSummaryCard
            summary={csvStats.summary}
            lastImport={csvStats.lastImport}
            categoryStatus={csvStats.categoryStatus}
          />
        )}

        {!isLoading && !error && !csvStats?.hasData && (
          <Alert severity="info" sx={{ maxWidth: 600 }}>
            No SCStats data imported yet. Use the button below to import your gameplay statistics
            from the SCStats desktop application.
          </Alert>
        )}

        <Stack direction="row" gap={1}>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => setImportOpen(true)}
          >
            {csvStats?.hasData ? 'Re-import SCStats Data' : 'Import SCStats Data'}
          </Button>
          {csvStats?.hasData && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              disabled={deleteCsv.isPending}
            >
              Delete Data
            </Button>
          )}
        </Stack>

        <SCStatsImportDialog
          userId={userId}
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setImportOpen(false);
            refetch();
          }}
        />

        {/* ---------- Org Analytics Section ---------- */}
        {orgId && (
          <>
            <Divider sx={{ my: 2 }} />
            <SCStatsOrgDashboard organizationId={orgId} />
          </>
        )}
      </Stack>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// CSV Summary Card
// ---------------------------------------------------------------------------

interface CsvSummaryCardProps {
  summary: SCStatsCsvSummary;
  lastImport: string | null;
  categoryStatus: SCStatsCsvCategoryStatus | null;
}

const CsvSummaryCard: React.FC<CsvSummaryCardProps> = ({ summary, lastImport, categoryStatus }) => (
  <Card variant="outlined" sx={{ maxWidth: 800 }}>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Gameplay Summary</Typography>
        {lastImport && (
          <Typography variant="caption" color="text.secondary">
            Last imported: {new Date(lastImport).toLocaleDateString()}
          </Typography>
        )}
      </Stack>

      {/* Per-category import status */}
      {categoryStatus && <CategoryStatusRow categoryStatus={categoryStatus} />}

      <Divider sx={{ my: 2 }} />

      {/* Playtime stats */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatItem
            icon={<TimerIcon color="primary" />}
            label="Total Playtime"
            value={`${summary.totalPlaytimeHours}h`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatItem
            icon={<TimerIcon color="primary" />}
            label="Versions Played"
            value={String(summary.versionsPlayed)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatItem
            icon={<TimerIcon color="primary" />}
            label="Most Played"
            value={summary.mostPlayedVersion}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* Ships stats */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatItem
            icon={<RocketLaunchIcon color="secondary" />}
            label="Ships Flown"
            value={String(summary.totalShipsFlown)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatItem
            icon={<RocketLaunchIcon color="secondary" />}
            label="Flight Time"
            value={`${summary.totalFlightTimeHours}h`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatItem
            icon={<RocketLaunchIcon color="secondary" />}
            label="Most Flown"
            value={summary.mostFlownShip}
          />
        </Grid>
      </Grid>

      {/* Purchases & Loadout stats */}
      {(summary.uniqueItemsPurchased > 0 || summary.totalLoadoutSessions > 0) && (
        <>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            {summary.uniqueItemsPurchased > 0 && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <StatItem
                  icon={<ShoppingCartIcon color="warning" />}
                  label="Items Purchased"
                  value={String(summary.uniqueItemsPurchased)}
                />
              </Grid>
            )}
            {summary.totalAuecSpent > 0 && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <StatItem
                  icon={<MonetizationOnIcon color="warning" />}
                  label="aUEC Spent"
                  value={summary.totalAuecSpent.toLocaleString()}
                />
              </Grid>
            )}
            {summary.primaryWeapon !== 'N/A' && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <StatItem
                  icon={<SecurityIcon color="error" />}
                  label="Primary Weapon"
                  value={summary.primaryWeapon}
                />
              </Grid>
            )}
          </Grid>
        </>
      )}

      {/* Career hours breakdown (aggregated skills) */}
      {summary.hoursByCareer && summary.hoursByCareer.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <CareerBreakdown careers={summary.hoursByCareer} />
        </>
      )}
    </CardContent>
  </Card>
);

// ---------------------------------------------------------------------------
// Per-category import status
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: { key: keyof SCStatsCsvCategoryStatus; label: string }[] = [
  { key: 'playtimeImportedAt', label: 'Playtime' },
  { key: 'loadoutImportedAt', label: 'Loadout' },
  { key: 'purchasesImportedAt', label: 'Purchases' },
  { key: 'shipsImportedAt', label: 'Ships' },
];

interface CategoryStatusRowProps {
  categoryStatus: SCStatsCsvCategoryStatus;
}

const CategoryStatusRow: React.FC<CategoryStatusRowProps> = ({ categoryStatus }) => (
  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
    {CATEGORY_LABELS.map(({ key, label }) => {
      const importedAt = categoryStatus[key];
      return (
        <Chip
          key={key}
          icon={importedAt ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
          label={label}
          color={importedAt ? 'success' : 'default'}
          variant={importedAt ? 'filled' : 'outlined'}
          size="small"
        />
      );
    })}
  </Stack>
);

// ---------------------------------------------------------------------------
// Career Breakdown (aggregated skills from hoursByCareer)
// ---------------------------------------------------------------------------

interface CareerBreakdownProps {
  careers: SCStatsCareerHours[];
}

const CareerBreakdown: React.FC<CareerBreakdownProps> = ({ careers }) => {
  const totalHours = careers.reduce((sum, c) => sum + c.hours, 0);

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
        <WorkIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2">Flight Hours by Career</Typography>
      </Stack>
      <Stack spacing={1}>
        {careers.map(career => {
          const percentage = totalHours > 0 ? (career.hours / totalHours) * 100 : 0;
          return (
            <Stack key={career.career} spacing={0.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">
                  {career.career} ({career.shipCount} {career.shipCount === 1 ? 'ship' : 'ships'})
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {career.hours.toFixed(1)}h
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={percentage}
                sx={{
                  height: 6,
                  borderRadius: 3,
                }}
              />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Stat Item
// ---------------------------------------------------------------------------

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, label, value }) => (
  <Stack direction="row" alignItems="center" gap={1}>
    {icon}
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} noWrap>
        {value}
      </Typography>
    </Box>
  </Stack>
);

// ---------------------------------------------------------------------------
// Error boundary wrapper for route use
// ---------------------------------------------------------------------------

export const SCStatsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="SCStats">
    <SCStatsPage />
  </FeatureErrorBoundary>
);
